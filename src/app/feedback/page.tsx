import { FeedbackForm } from "@/components/FeedbackForm";
import { PageTitle } from "@/components/league/ui";

export const metadata = { title: "Feedback", robots: { index: false } };

export default function FeedbackPage() {
  return (
    <div className="mx-auto max-w-xl">
      <PageTitle eyebrow="Feedback" title="Ideas & bugs">
        <p className="mt-3 text-sm text-muted">Found something broken or have an idea? Tell me. It goes straight to the person who builds F1 HUB.</p>
      </PageTitle>
      <FeedbackForm />
    </div>
  );
}
