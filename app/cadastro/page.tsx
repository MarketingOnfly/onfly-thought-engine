import { Suspense } from "react";
import SignupForm from "./signup-form";

export const dynamic = "force-dynamic";

export default function CadastroPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}
