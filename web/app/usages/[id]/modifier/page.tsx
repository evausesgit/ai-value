"use client";

import { use, useEffect, useState } from "react";
import UseCaseForm from "@/components/UseCaseForm";
import { api, type UseCase } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export default function EditUseCasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { m } = useI18n();
  const [uc, setUc] = useState<UseCase | null>(null);
  useEffect(() => {
    api<UseCase>(`/usecases/${id}`).then(setUc);
  }, [id]);
  return (
    <main className="page narrow">
      <div className="page-head">
        <h1>{m.usecases.editTitle}</h1>
      </div>
      {uc ? <UseCaseForm initial={uc} id={uc.id} /> : <p className="muted">{m.common.loading}</p>}
    </main>
  );
}
