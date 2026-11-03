import { PageSkeleton } from "@/components/account/skeletons";

export default function Loading() {
  return <PageSkeleton label="Loading theory questions" hero={false} rows={6} narrow={true} />;
}
