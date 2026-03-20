import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Gift, Copy, Share2, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ReferralCodeResponse {
  code: string;
  share_link: string;
}

interface ReferralCreditsResponse {
  available_credits: number;
  used_credits: number;
  total_credits: number;
  discount_pct: string;
}

export default function ReferralCard() {
  const { toast } = useToast();
  const [referralCode, setReferralCode] = useState<ReferralCodeResponse | null>(null);
  const [credits, setCredits] = useState<ReferralCreditsResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchReferralData = async () => {
      const token = localStorage.getItem("token");
      if (!token) return;

      try {
        // Fetch referral code and credits in parallel
        const [codeRes, creditsRes] = await Promise.all([
          fetch("/api/payments/referral/code/", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch("/api/payments/referral/credits/", {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (codeRes.ok) {
          const codeData = await codeRes.json();
          setReferralCode(codeData);
        }
        if (creditsRes.ok) {
          const creditsData = await creditsRes.json();
          setCredits(creditsData);
        }
      } catch {
        // Silently fail
      }
      setIsLoading(false);
    };

    fetchReferralData();
  }, []);

  const handleCopy = async () => {
    if (!referralCode) return;
    try {
      await navigator.clipboard.writeText(referralCode.code);
      setCopied(true);
      toast({ title: "Copied!", description: "Referral code copied to clipboard." });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = referralCode.code;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = async () => {
    if (!referralCode) return;

    const shareData = {
      title: "Join ZimFeast!",
      text: `Use my referral code ${referralCode.code} to sign up on ZimFeast! After your first $20+ order, I get a 15% discount credit.`,
      url: referralCode.share_link,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // User cancelled share
      }
    } else {
      // Fallback: copy share link
      await navigator.clipboard.writeText(
        `${shareData.text}\n${shareData.url}`
      );
      toast({ title: "Share link copied!", description: "Share the link with friends." });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-1/3"></div>
            <div className="h-8 bg-muted rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!referralCode) return null;

  return (
    <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/20 dark:to-background">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Gift className="h-5 w-5 text-purple-500" />
          Refer Friends, Get Rewards
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Share your referral code with friends. When they sign up and spend $20+ on their first order,
          you earn a <span className="font-semibold text-purple-600">15% discount credit</span>.
        </p>

        {/* Referral Code Display */}
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-white dark:bg-background border-2 border-dashed border-purple-300 rounded-lg px-4 py-3 text-center">
            <span className="text-xl font-bold tracking-wider text-purple-700 dark:text-purple-400">
              {referralCode.code}
            </span>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={handleCopy}
            className="shrink-0"
            title="Copy code"
          >
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handleShare}
            className="shrink-0"
            title="Share"
          >
            <Share2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Credits Summary */}
        {credits && (
          <div className="flex items-center gap-3 pt-2">
            <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
              {credits.available_credits} credit{credits.available_credits !== 1 ? "s" : ""} available
            </Badge>
            <span className="text-xs text-muted-foreground">
              {credits.total_credits} total earned / {credits.used_credits} used
            </span>
          </div>
        )}

        {/* Share Link */}
        <div className="pt-1">
          <p className="text-xs text-muted-foreground break-all">
            Share link: {referralCode.share_link}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
