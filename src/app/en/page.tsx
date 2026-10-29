import { Home } from "@/components/Home";
import { homeMetadata } from "@/lib/pages";

export const metadata = homeMetadata("en");

export default function Page() {
  return <Home locale="en" />;
}
