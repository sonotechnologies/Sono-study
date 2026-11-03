import { PageSkeleton } from "@/components/account/skeletons";

export default function Loading() {
  return <PageSkeleton label="Loading tutor" hero={false} rows={3} narrow={true} />;
}
