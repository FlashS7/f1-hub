import Link from "next/link";

export const metadata = { title: "Offline" };

export default function Offline() {
  return (
    <div className="panel mx-auto mt-10 max-w-md p-7 text-center">
      <p className="eyebrow">No connection</p>
      <h1 className="display mt-2 text-4xl italic">Red flag</h1>
      <p className="mt-3 text-muted">You&apos;re offline and this page isn&apos;t saved yet. The hub shows the last known data.</p>
      <Link href="/" className="btn-primary mt-5">
        Back to hub
      </Link>
    </div>
  );
}
