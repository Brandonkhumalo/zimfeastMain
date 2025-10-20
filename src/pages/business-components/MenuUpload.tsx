import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function MenuUpload() {
  const [file, setFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file) return;
    const formData = new FormData();
    formData.append("menu", file);

    await fetch("http://127.0.0.1:8000/api/upload-menu/", {
      method: "POST",
      body: formData,
    });

    alert("Menu uploaded!");
  };

  return (
    <div className="space-y-2">
      <input type="file" accept="image/*" onChange={handleFileChange} />
      <Button onClick={handleUpload} disabled={!file}>
        Upload Menu
      </Button>
    </div>
  );
}
