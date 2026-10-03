"use client";

import UseCaseForm from "@/components/UseCaseForm";
import { useI18n } from "@/lib/i18n";

export default function NewUseCasePage() {
  const { m } = useI18n();
  return (
    <main className="page narrow">
      <div className="page-head">
        <div>
          <h1>{m.usecases.newTitle}</h1>
          <p className="sub">{m.usecases.newSubtitle}</p>
        </div>
      </div>
      <UseCaseForm />
    </main>
  );
}
