"use server";

import { prisma } from "@/lib/prisma";

import { questionnaireSchema, type QuestionnaireValues } from "./schema";

export type SubmitQuestionnaireResult = { success: true } | { success: false; error: string };

/** Azione pubblica: il token (a perdere dopo l'uso) identifica la cliente e il centro. */
export async function submitQuestionnaire(
  token: string,
  values: QuestionnaireValues
): Promise<SubmitQuestionnaireResult> {
  const parsed = questionnaireSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: "Controlla i dati inseriti." };
  }

  const questionnaire = await prisma.clientQuestionnaire.findUnique({
    where: { token },
    include: { client: { select: { id: true, email: true } } },
  });
  if (!questionnaire) {
    return { success: false, error: "Link non valido." };
  }
  if (questionnaire.completedAt) {
    return { success: false, error: "Hai già compilato il questionario. Grazie!" };
  }

  const data = parsed.data;
  const clean = (value: string) => (value ? value : null);

  await prisma.$transaction([
    prisma.client.update({
      where: { id: questionnaire.client.id },
      data: {
        ...(data.dateOfBirth && { dateOfBirth: new Date(`${data.dateOfBirth}T00:00:00.000Z`) }),
        ...(data.city && { city: data.city }),
        ...(data.email && !questionnaire.client.email && { email: data.email }),
        allergies: clean(data.allergies),
        healthNotes: clean(data.healthNotes),
        acquisitionSource: clean(data.acquisitionSource),
        interests: data.interests,
      },
    }),
    prisma.clientQuestionnaire.update({
      where: { id: questionnaire.id },
      data: { completedAt: new Date(), answers: data },
    }),
  ]);

  return { success: true };
}
