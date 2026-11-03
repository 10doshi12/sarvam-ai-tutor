"use client";

import { useState } from "react";
import { DEFAULT_TUTOR } from "@/lib/config";
import type { TutorId } from "@/lib/types";
import Avatar from "@/components/player/Avatar";
import UploadForm from "./UploadForm";

// Holds the chosen tutor so the large tile previews whoever is picked in the form.
export default function StartPanel() {
  const [tutor, setTutor] = useState<TutorId>(DEFAULT_TUTOR);
  return (
    <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-5">
      {/* The form sets the row height; the avatar fills it instead of pushing it taller. */}
      <div className="nb-card relative hidden overflow-hidden bg-accent lg:col-span-2 lg:block">
        <div className="absolute inset-0">
          <Avatar speaking={false} mood="neutral" tutor={tutor} />
        </div>
      </div>
      <UploadForm tutor={tutor} onTutor={setTutor} />
    </div>
  );
}
