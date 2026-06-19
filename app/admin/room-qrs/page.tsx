import { RoomQrCodePage } from "@/components/rooms/room-qr-code-page";
import { requirePageAdmin } from "@/lib/server-auth";

export default async function AdminRoomQrsPage() {
  await requirePageAdmin();

  return <RoomQrCodePage />;
}
