import { PageSkeleton } from "@/components/account/skeletons";

export default function Loading() {
  return <PageSkeleton label="Loading course" hero={true} rows={4} narrow={false} />;
}
