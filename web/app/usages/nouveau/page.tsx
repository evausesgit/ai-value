import UseCaseForm from "@/components/UseCaseForm";

export default function NewUseCasePage() {
  return (
    <main className="page narrow">
      <div className="page-head">
        <div>
          <h1>Partager un use case</h1>
          <p className="sub">Ce que tu fais avec l&apos;IA peut faire gagner du temps à toute l&apos;organisation.</p>
        </div>
      </div>
      <UseCaseForm />
    </main>
  );
}
