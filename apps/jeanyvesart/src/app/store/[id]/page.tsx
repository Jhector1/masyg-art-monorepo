export {generateMetadata} from "./metadata";
import OriginalArtworkDetails from "@/components/store/painting/OriginalArtworkDetails";
export default async function Page({params}:{params:Promise<{id:string}>}) {
  const {id}=await params;
  return <OriginalArtworkDetails slug={id}/>;
}
