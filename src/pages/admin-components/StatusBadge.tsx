import { Badge } from "@/components/ui/badge";
import { Check, X, Clock } from "lucide-react";

interface StatusBadgeProps {
  status: 'pending' | 'approved' | 'rejected' | string;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  switch (status) {
    case 'pending':
      return <Badge variant="outline" className="text-yellow-600 border-yellow-600"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
    case 'approved':
      return <Badge variant="outline" className="text-green-600 border-green-600"><Check className="w-3 h-3 mr-1" />Approved</Badge>;
    case 'rejected':
      return <Badge variant="outline" className="text-red-600 border-red-600"><X className="w-3 h-3 mr-1" />Rejected</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}
