"use client";

import React,{createContext,useContext,useEffect,useState} from "react";
import {useUser} from "./UserContext";
import {getCurrentStorefront,listStoreFavorites,setStoreFavorite} from "../lib/client/storefront-commerce";

type FavoriteContextProps={
  favorites:Set<string>;ready:boolean;
  isFavorite:(productId:string)=>boolean;
  toggleFavorite:(productId:string)=>Promise<void>;
  addFavorite:(productId:string)=>Promise<void>;
  removeFavorite:(productId:string)=>Promise<void>;
  refreshFavorites:(args?:{types?:string})=>Promise<void>;
};
const FavoriteContext=createContext<FavoriteContextProps|undefined>(undefined);
export function useFavorites() {
  const ctx=useContext(FavoriteContext);
  if(!ctx)throw new Error("useFavorites must be used within a FavoriteProvider");
  return ctx;
}
export function FavoriteProvider({children}:{children:React.ReactNode}) {
  const {isLoggedIn,sessionPulse}=useUser();
  const [favorites,setFavorites]=useState<Set<string>>(()=>new Set());
  const [ready,setReady]=useState(false);
  const [storeId,setStoreId]=useState<string|null>(null);
  const refreshFavorites=async (_args:{types?:string}={})=>{
    if(!isLoggedIn){setFavorites(new Set());setReady(true);return;}
    try {
      const context=await getCurrentStorefront();
      const result=await listStoreFavorites(context.store.id);
      if(result.store.id!==context.store.id)throw new Error("Storefront mismatch");
      setStoreId(context.store.id);setFavorites(new Set(result.favorites));
    }catch{setFavorites(new Set());setStoreId(null);}
    finally{setReady(true);}
  };
  useEffect(()=>{
    let mounted=true;
    setReady(false);
    if(!isLoggedIn){setFavorites(new Set());setStoreId(null);setReady(true);return;}
    void (async()=>{
      try {
        const context=await getCurrentStorefront();
        const result=await listStoreFavorites(context.store.id);
        if(!mounted)return;
        if(result.store.id!==context.store.id)throw new Error("Storefront mismatch");
        setStoreId(context.store.id);setFavorites(new Set(result.favorites));
      }catch{if(mounted){setStoreId(null);setFavorites(new Set());}}
      finally{if(mounted)setReady(true);}
    })();
    return ()=>{mounted=false;};
  },[isLoggedIn,sessionPulse]);
  async function updateFavorite(productId:string,enabled:boolean) {
    if(!isLoggedIn)throw new Error("Sign in to save favorites");
    const current=storeId ?? (await getCurrentStorefront()).store.id;
    await setStoreFavorite(current,productId,enabled);
    setFavorites(prev=>{
      const next=new Set(prev);
      if(enabled)next.add(productId);else next.delete(productId);
      return next;
    });
  }
  const addFavorite=(id:string)=>updateFavorite(id,true);
  const removeFavorite=(id:string)=>updateFavorite(id,false);
  const toggleFavorite=(id:string)=>updateFavorite(id,!favorites.has(id));
  return <FavoriteContext.Provider value={{favorites,ready,isFavorite:(id)=>favorites.has(id),toggleFavorite,addFavorite,removeFavorite,refreshFavorites}}>{children}</FavoriteContext.Provider>;
}
