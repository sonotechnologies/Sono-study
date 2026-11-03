import { PageSkeleton } from "@/components/account/skeletons";

export default function Loading() {
  return <PageSkeleton label="Loading results" hero={true} rows={6} narrow={true} />;
}
