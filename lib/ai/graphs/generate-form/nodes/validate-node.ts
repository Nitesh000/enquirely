import { validateDefinition } from "@/lib/forms/validate-definition";
import { FormGenerationState, GenerateFormDeps } from "../generate-form";

export const validateNode = async (
  state: FormGenerationState,
  _deps: GenerateFormDeps,
): Promise<Partial<FormGenerationState>> => {
  if (!state.draft) {
    return {
      issues: state.issues.length ? state.issues : ["No form produced"],
    };
  }
  const issues = validateDefinition(state.draft).map((i) => i.message);
  return { issues };
};
