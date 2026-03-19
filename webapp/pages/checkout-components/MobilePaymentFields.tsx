import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface MobilePaymentFieldsProps {
  phoneNumber: string;
  setPhoneNumber: (val: string) => void;
  mobileProvider: string;
  setMobileProvider: (val: string) => void;
}

export const MobilePaymentFields = ({
  phoneNumber,
  setPhoneNumber,
  mobileProvider,
  setMobileProvider,
}: MobilePaymentFieldsProps) => (
  <>
    <div>
      <label className="text-sm font-medium mb-2 block">Mobile Provider</label>
      <Select value={mobileProvider} onValueChange={setMobileProvider}>
        <SelectTrigger>
          <SelectValue placeholder="Select provider" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ecocash">EcoCash</SelectItem>
          <SelectItem value="onemoney">OneMoney</SelectItem>
          <SelectItem value="telecash">TeleCash</SelectItem>
        </SelectContent>
      </Select>
    </div>
    <div>
      <label className="text-sm font-medium mb-2 block">Phone Number</label>
      <Input
        type="tel"
        placeholder="+263 77 123 4567 or 0771234567"
        value={phoneNumber}
        onChange={e => setPhoneNumber(e.target.value)}
        required
      />
    </div>
  </>
);
