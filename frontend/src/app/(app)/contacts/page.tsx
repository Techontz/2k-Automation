import { Suspense } from "react";
import { ContactsView } from "@/components/contacts/contacts-view";

export const metadata = { title: "Contacts" };

export default function ContactsPage() {
  return (
    <Suspense>
      <ContactsView />
    </Suspense>
  );
}
