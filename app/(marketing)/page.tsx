import { redirect } from "next/navigation";

/** The landing page (design 4a) is a later milestone; send students into the app. */
export default function Root() {
  redirect("/home");
}
