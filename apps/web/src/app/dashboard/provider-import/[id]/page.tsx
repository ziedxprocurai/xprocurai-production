import { ReviewContent } from './review-content';

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return <ReviewContent documentId={id} />;
}
