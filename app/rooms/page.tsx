import { Suspense } from "react";

import { RoomActiveReportsPage } from "./room-active-reports-page";

export default function RoomsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background px-4 py-6 text-sm text-muted-foreground sm:px-6 sm:py-10">
          Loading room...
        </div>
      }
    >
      <RoomActiveReportsPage />
    </Suspense>
  );
}
