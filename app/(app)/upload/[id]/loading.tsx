import { PageSkeleton } from "@/components/account/skeletons";

export default function Loading() {
  return <PageSkeleton label="Loading upload" hero={true} rows={2} narrow={true} />;
}
