import { prisma } from "@/lib/db";
import { checkAnswerSchema } from "@/schemas/questions";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { distance } from "fastest-levenshtein";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function POST(req: Request, res: Response) {
  try {
    const body = await req.json();
    const { questionId, userInput } = checkAnswerSchema.parse(body);

    const question = await prisma.question.findUnique({
      where: { id: questionId },
    });

    if (!question) {
      return NextResponse.json(
        { message: "Question not found" },
        { status: 404 }
      );
    }

    await prisma.question.update({
      where: { id: questionId },
      data: { userAnswer: userInput },
    });

    if (question.questionType === "mcq") {
      const isCorrect =
        question.answer.toLowerCase().trim() ===
        userInput.toLowerCase().trim();

      await prisma.question.update({
        where: { id: questionId },
        data: { isCorrect },
      });

      return NextResponse.json({ isCorrect });
    }

    if (question.questionType === "open_ended") {
      const answer = question.answer.toLowerCase().trim();
      const input = userInput.toLowerCase().trim();

      const dist = distance(answer, input);
      const maxLen = Math.max(answer.length, input.length);

      // Convert distance into percentage similarity
      const percentageSimilar = Math.round(((maxLen - dist) / maxLen) * 100);

      await prisma.question.update({
        where: { id: questionId },
        data: { percentageCorrect: percentageSimilar },
      });

      return NextResponse.json({ percentageSimilar });
    }
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ message: error.issues }, { status: 400 });
    }

    return NextResponse.json(
      { message: "Something went wrong", error: String(error) },
      { status: 500 }
    );
  }
}
