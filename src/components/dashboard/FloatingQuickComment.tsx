"use client";
import React, { useState } from "react";
import { QuickCommentBox } from "@/components/dashboard/QuickCommentBox";
import { Button } from "@/components/ui/button";
import { MessageSquare, X } from "lucide-react";

export const FloatingQuickComment: React.FC = () => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="fixed z-50 bottom-6 right-6 flex flex-col items-end gap-3">
        {open && (
          <div className="w-80 max-w-[90vw] max-h-[75vh] overflow-y-auto rounded-xl shadow-xl animate-in fade-in zoom-in-95 duration-200 bg-background/95 backdrop-blur border">
            <div className="absolute top-2 right-2">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={()=>setOpen(false)} aria-label="Fermer les commentaires">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <QuickCommentBox />
          </div>
        )}
        <Button onClick={()=>setOpen(o=>!o)} className="rounded-full h-12 w-12 shadow-lg bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800" aria-label="Commentaire rapide">
          <MessageSquare className="h-5 w-5" />
        </Button>
      </div>
    </>
  );
};

export default FloatingQuickComment;