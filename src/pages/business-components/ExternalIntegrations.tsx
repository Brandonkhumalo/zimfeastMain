import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

interface Props {
  register: any; // from react-hook-form
}

export default function ExternalIntegrations({ register }: Props) {
  return (
    <div className="space-y-4 border p-4 rounded">
      <label className="flex items-center space-x-2">
        <Checkbox {...register("hasExternalMenu")} />
        <span>Use external menu API</span>
      </label>
      <Input placeholder="Menu API Endpoint" {...register("menuApiEndpoint")} />
      <Input placeholder="Menu API Key" {...register("menuApiKey")} />
      <Input placeholder="Menu API Name" {...register("menuApiName")} />

      <label className="flex items-center space-x-2 mt-4">
        <Checkbox {...register("hasExternalOrderSystem")} />
        <span>Use external order API</span>
      </label>
      <Input placeholder="Order API Endpoint" {...register("orderApiEndpoint")} />
      <Input placeholder="Order API Key" {...register("orderApiKey")} />
      <Input placeholder="Order API Name" {...register("orderApiName")} />
    </div>
  );
}
