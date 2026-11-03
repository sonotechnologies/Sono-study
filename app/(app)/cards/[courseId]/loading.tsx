import { PageSkeleton } from "@/components/account/skeletons";

export default function Loading() {
  return <PageSkeleton label="Loading flashcards" hero={true} rows={0} narrow={true} />;
}
