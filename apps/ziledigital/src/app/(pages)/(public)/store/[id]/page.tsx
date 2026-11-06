export {generateMetadata} from "./metadata";
import ProductDetail from "./ProductClient";

export default async function ProductPage({params}:{params:Promise<{id:string}>}){
  const {id:slug}=await params;
  return <ProductDetail slug={slug}/>;
}
