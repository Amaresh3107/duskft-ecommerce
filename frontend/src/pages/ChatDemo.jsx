import { ChatWidget } from '../components/ChatWidget';

export default function ChatDemo() {
  return (
    <div className="min-h-screen bg-[#F9F8F6] px-6 py-16">
      <div className="mx-auto max-w-2xl">
        <p className="text-xs uppercase tracking-[0.2em] text-[#5E6A7D]">Phase 2 — Standalone Component Preview</p>
        <h1 className="font-display mt-3 text-4xl text-[#121826] sm:text-5xl">Chat Widget Demo</h1>
        <p className="mt-4 max-w-lg text-base text-[#5E6A7D]">
          This is a temporary preview page. The chat widget in the bottom-right corner is the exact reusable
          component that will be dropped into the real Storefront in Phase 3 — no rework needed. Try asking
          about products, MOQ, shipping, or returns.
        </p>
      </div>
      <ChatWidget />
    </div>
  );
}
