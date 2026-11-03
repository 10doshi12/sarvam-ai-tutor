import HealthBanner from "@/components/home/HealthBanner";
import LessonList from "@/components/home/LessonList";
import UploadForm from "@/components/home/UploadForm";

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">AI Avatar Tutor</h1>
        <p className="text-ink/80">
          Upload a textbook chapter and a tutor teaches it aloud on a whiteboard. Interrupt any time with a doubt.
        </p>
      </header>
      <HealthBanner />
      <UploadForm />
      <LessonList />
    </main>
  );
}
