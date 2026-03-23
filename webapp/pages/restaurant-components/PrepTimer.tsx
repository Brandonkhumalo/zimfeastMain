import { useState, useEffect } from "react";

interface PrepTimerProps {
  preparingStartedAt: string;
  /** Estimated prep time in minutes (defaults to 20 if not provided) */
  totalPrepTimeMinutes?: number;
}

export default function PrepTimer({ preparingStartedAt, totalPrepTimeMinutes = 20 }: PrepTimerProps) {
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);

  useEffect(() => {
    const totalSeconds = totalPrepTimeMinutes * 60;

    const tick = () => {
      const elapsed = (Date.now() - Date.parse(preparingStartedAt)) / 1000;
      setRemainingSeconds(Math.round(totalSeconds - elapsed));
    };

    tick(); // initial
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [preparingStartedAt, totalPrepTimeMinutes]);

  const totalSeconds = totalPrepTimeMinutes * 60;
  const pct = totalSeconds > 0 ? Math.max(0, remainingSeconds / totalSeconds) : 0;
  const isOverdue = remainingSeconds <= 0;

  const absSeconds = Math.abs(remainingSeconds);
  const minutes = Math.floor(absSeconds / 60);
  const seconds = absSeconds % 60;
  const display = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  let colorClass: string;
  let bgClass: string;
  if (isOverdue) {
    colorClass = "text-red-700";
    bgClass = "bg-red-100";
  } else if (pct < 0.2) {
    colorClass = "text-red-600";
    bgClass = "bg-red-50";
  } else if (pct < 0.5) {
    colorClass = "text-yellow-700";
    bgClass = "bg-yellow-50";
  } else {
    colorClass = "text-green-700";
    bgClass = "bg-green-50";
  }

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${bgClass}`}>
      <i className={`fas fa-clock ${colorClass} text-sm`}></i>
      <span className={`font-mono font-bold text-sm ${colorClass}`}>
        {isOverdue ? `-${display}` : display}
      </span>
      <span className={`text-xs ${colorClass}`}>
        {isOverdue ? "OVERDUE" : "remaining"}
      </span>
    </div>
  );
}
