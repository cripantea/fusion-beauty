#!/usr/bin/env bash
# Mette le chiavi di Fusion WA nei secrets del repository GitHub: al prossimo
# deploy (push su main) .github/workflows/deploy.yml le scrive nel .env del
# server. Sul server non serve fare nulla, come per il CRM.
#
# Uso (sul tuo Mac, nella cartella del progetto, con `gh` autenticato):
#   bash scripts/fusion-wa-secrets.sh
#
# Chiave e secret si prendono dal .env locale (scritti da fusion-wa-env.sh);
# se mancano si chiedono. Il token del webhook di produzione si genera qui la
# prima volta e si stampa una volta sola: va incollato su Fusion WA.
set -euo pipefail

REPO="${REPO:-cripantea/fusion-beauty}"
APP_URL="${APP_URL:-https://beauty.fusionsoft.it}"

current() { [ -f .env ] && grep -E "^$1=" .env | tail -n 1 | cut -d= -f2- | sed -e "s/^[\"']//" -e "s/[\"']\$//" || true; }

command -v gh >/dev/null || { echo "Serve la GitHub CLI (gh): brew install gh && gh auth login" >&2; exit 1; }

API_KEY="$(current FUSION_WA_API_KEY)"
API_SECRET="$(current FUSION_WA_API_SECRET)"
if [[ -z "$API_KEY" ]]; then read -r -p "API Key di Fusion WA (fwa_live_…): " API_KEY; fi
if [[ -z "$API_SECRET" ]]; then read -r -s -p "API Secret (non viene mostrato): " API_SECRET; echo; fi
[[ "$API_KEY" =~ ^fwa_[A-Za-z0-9_]+$ ]] || { echo "La chiave deve iniziare con fwa_." >&2; exit 1; }
[[ -n "$API_SECRET" ]] || { echo "Il secret è vuoto." >&2; exit 1; }

STATUS="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 \
  -H "x-fusionwa-api-key: $API_KEY" -H "x-fusionwa-api-secret: $API_SECRET" \
  "https://fusionwa.com/api/v1/connections/status?externalCustomerId=prova-credenziali" || echo 000)"
if [[ "$STATUS" == 401 || "$STATUS" == 403 ]]; then
  echo "❌ Fusion WA rifiuta chiave o secret (HTTP $STATUS): non carico nulla." >&2
  exit 1
fi

# I valori passano a gh dallo standard input: non finiscono nella riga di comando.
printf '%s' "$API_KEY" | gh secret set FUSION_WA_API_KEY --repo "$REPO"
printf '%s' "$API_SECRET" | gh secret set FUSION_WA_API_SECRET --repo "$REPO"

if gh secret list --repo "$REPO" | awk '$1=="FUSION_WA_WEBHOOK_TOKEN"' | grep -q . && [[ "${NEW_TOKEN:-}" != "1" ]]; then
  echo "✅ Chiave e secret caricati su $REPO."
  echo "Il token del webhook c'era già: l'indirizzo su Fusion WA resta lo stesso."
  echo "(Per generarne uno nuovo: NEW_TOKEN=1 bash scripts/fusion-wa-secrets.sh)"
else
  TOKEN="$(openssl rand -hex 24)"
  printf '%s' "$TOKEN" | gh secret set FUSION_WA_WEBHOOK_TOKEN --repo "$REPO"
  echo "✅ Chiave, secret e token del webhook caricati su $REPO."
  echo
  echo "Su fusionwa.com → Applicazioni → Beauty crm → Webhook incolla e salva:"
  echo "  ${APP_URL%/}/api/webhooks/whatsapp?token=$TOKEN"
fi
echo
echo "Le chiavi arrivano sul server al prossimo deploy (push su main)."
