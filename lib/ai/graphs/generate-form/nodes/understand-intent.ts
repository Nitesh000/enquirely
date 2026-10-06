import { FormGenerationState, GenerateFormDeps } from "../generate-form";
import { Intent, intentSchema } from "../schema";

export const understandIntent = async (
  state: FormGenerationState,
  deps: GenerateFormDeps,
): Promise<Partial<FormGenerationState>> => {
  const model = deps.fast.withStructuredOutput(intentSchema, {
    name: "intent",
  });

  const intent = (await model.invoke([
    {
      role: "system",
      content:
        "You plan surveys. Rad the brief and state the goal, the audience, the tone, and how many questions it should have. Short surveys get finished; prefer fewer questions unless the brief demans more.",
    },
    { role: "human", content: state.brief },
  ])) as Intent;

  return { intent };
};
