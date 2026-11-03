import HealthBanner from "@/components/home/HealthBanner";
import LessonList from "@/components/home/LessonList";
import StartPanel from "@/components/home/StartPanel";

export default function Home() {
  return (
    <main className="mx-auto max-w-6xl space-y-5 px-4 py-5 sm:px-6">
      <HealthBanner />
      <header className="space-y-2">
        <p className="inline-block rounded-md bg-ink px-2.5 py-0.5 text-xs font-bold tracking-wide text-surface">Doubtless</p>
        <h1 className="text-[clamp(1.75rem,3.5vw,2.5rem)] leading-[1.1] font-bold tracking-tight text-balance">
          Turn any chapter into a live tutor.
        </h1>
        <p className="max-w-[60ch] text-balance text-muted lg:max-w-none">
          It teaches aloud, writes on a whiteboard, and stops to answer the moment you have a doubt.
        </p>
      </header>
      <StartPanel />
      <LessonList />
    </main>
  );
}
