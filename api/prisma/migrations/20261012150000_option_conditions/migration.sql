-- S5R2-02 : options conditionnelles
-- Une nouvelle table, aucune donnée existante touchée : toutes les
-- options actuelles restent « toujours proposées » (aucune ligne).

-- CreateTable
CREATE TABLE "OptionCondition" (
    "optionId" TEXT NOT NULL,
    "triggerOptionId" TEXT NOT NULL,

    CONSTRAINT "OptionCondition_pkey" PRIMARY KEY ("optionId","triggerOptionId")
);

-- AddForeignKey
ALTER TABLE "OptionCondition" ADD CONSTRAINT "OptionCondition_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "QuestionOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptionCondition" ADD CONSTRAINT "OptionCondition_triggerOptionId_fkey" FOREIGN KEY ("triggerOptionId") REFERENCES "QuestionOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;
