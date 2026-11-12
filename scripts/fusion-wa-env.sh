#!/usr/bin/env bash
# Inserisce chiave e secret dell'App "Fusion Beauty" di Fusion WA nel file .env,
# genera il token del webhook se manca e prova le credenziali.
#
# Uso (in locale o sul server, nella cartella del progetto):
#   bash scripts/fusion-wa-env.sh            # aggiorna ./.env
#   bash scripts/fusion-wa-env.sh /percorso/.env
#
# Il secret si digita senza che compaia a schermo e non finisce nella cronologia
# della shell. Prima di scrivere si fa una copia: .env.bak-<data>.
set -euo pipefail

ENV_FILE="${1:-.env}"
BASE_URL_DEFAULT="https://fusionwa.com"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "File $ENV_FILE non trovato. Crealo prima (es. cp .env.example .env)." >&2
  exit 1
fi

current() { grep -E "^$1=" "$ENV_FILE" | tail -n 1 | cut -d= -f2- | sed -e "s/^[\"']//" -e "s/[\"']\$//" || true; }

read -r -p "API Key di Fusion WA (fwa_live_…): " API_KEY
API_KEY="$(printf '%s' "$API_KEY" | tr -d '[:space:]')"
if [[ ! "$API_KEY" =~ ^fwa_[A-Za-z0-9_]+$ ]]; then
  echo "La chiave deve iniziare con fwa_ (la trovi su Fusion WA → Applicazioni)." >&2
  exit 1
fi

read -r -s -p "API Secret (non viene mostrato): " API_SECRET
echo
API_SECRET="$(printf '%s' "$API_SECRET" | tr -d '[:space:]')"
if [[ -z "$API_SECRET" ]]; then
  echo "Il secret è vuoto." >&2
  exit 1
fi
if [[ "$API_SECRET" == *"'"* ]]; then
  echo "Il secret contiene un apice ('): controlla di averlo copiato bene." >&2
  exit 1
fi

BASE_URL="$(current FUSION_WA_BASE_URL)"
BASE_URL="${BASE_URL:-$BASE_URL_DEFAULT}"
BASE_URL="${BASE_URL%/}"

# Prova delle credenziali: 401/403 = chiave o secret sbagliati
STATUS="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 \
  -H "x-fusionwa-api-key: $API_KEY" -H "x-fusionwa-api-secret: $API_SECRET" \
  "$BASE_URL/api/v1/connections/status?externalCustomerId=prova-credenziali" || echo 000)"
case "$STATUS" in
  200|404) echo "✅ Credenziali accettate da $BASE_URL" ;;
  401|403) echo "❌ $BASE_URL rifiuta chiave o secret (HTTP $STATUS): non scrivo nulla." >&2; exit 1 ;;
  *) echo "⚠️  $BASE_URL ha risposto HTTP $STATUS: non posso verificare, scrivo comunque." ;;
esac

WEBHOOK_TOKEN="$(current FUSION_WA_WEBHOOK_TOKEN)"
if [[ -z "$WEBHOOK_TOKEN" ]]; then
  WEBHOOK_TOKEN="$(openssl rand -hex 24)"
fi

cp "$ENV_FILE" "$ENV_FILE.bak-$(date +%Y%m%d%H%M%S)"

# Sostituisce la riga se c'è, altrimenti la aggiunge (awk: i valori non passano da sed).
# Apici singoli: né dotenv né docker compose espandono $ al loro interno.
set_var() {
  local key="$1" value="$2" tmp
  tmp="$(mktemp)"
  KEY="$key" VALUE="$value" awk '
    BEGIN { done = 0 }
    $0 ~ "^" ENVIRON["KEY"] "=" { if (!done) print ENVIRON["KEY"] "=\047" ENVIRON["VALUE"] "\047"; done = 1; next }
    { print }
    END { if (!done) print ENVIRON["KEY"] "=\047" ENVIRON["VALUE"] "\047" }
  ' "$ENV_FILE" > "$tmp"
  cat "$tmp" > "$ENV_FILE"
  rm -f "$tmp"
}

set_var FUSION_WA_BASE_URL "$BASE_URL"
set_var FUSION_WA_API_KEY "$API_KEY"
set_var FUSION_WA_API_SECRET "$API_SECRET"
set_var FUSION_WA_WEBHOOK_TOKEN "$WEBHOOK_TOKEN"

APP_URL="$(current APP_BASE_URL)"
APP_URL="${APP_URL:-https://beauty.fusionsoft.it}"
echo "✅ Scritto in $ENV_FILE (copia di prima: $ENV_FILE.bak-…)"
echo
echo "Ora su Fusion WA → Applicazioni → Fusion Beauty → Webhook, imposta:"
echo "  ${APP_URL%/}/api/webhooks/whatsapp?token=$WEBHOOK_TOKEN"
echo
echo "Poi riavvia l'app e il worker (in produzione: docker compose -f docker-compose.prod.yml up -d)."
