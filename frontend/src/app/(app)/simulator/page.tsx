import { Suspense } from "react";
import { SimulatorView } from "@/components/simulator/simulator-view";

export const metadata = { title: "Simulator" };

export default function SimulatorPage() {
  return (
    <Suspense>
      <SimulatorView />
    </Suspense>
  );
}
