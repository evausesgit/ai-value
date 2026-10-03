"use client";

import { use, useEffect, useState } from "react";
import UseCaseForm from "@/components/UseCaseForm";
import { api, type UseCase } from "@/lib/api";

export default function EditUseCasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [uc, setUc] = useState<UseCase | null>(null);
  useEffect(() => {
    api<UseCase>(`/usecases/${id}`).then(setUc);
  }, [id]);
  return (
    <main className="page narrow">
      <div className="page-head">
        <h1>Modifier le use case</h1>
      </div>
      {uc ? <UseCaseForm initial={uc} id={uc.id} /> : <p className="muted">Chargement…</p>}
    </main>
  );
}
