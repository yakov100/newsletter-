import { createValidateHandler } from "@/lib/ai/validate-route-handler";

export const POST = createValidateHandler(12, "שגיאה באימות הטיוטה");
