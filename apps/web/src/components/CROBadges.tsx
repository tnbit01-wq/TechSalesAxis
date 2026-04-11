import React from "react";
import { AlertCircle, Clock, CheckCircle } from "lucide-react";

interface CROUrgencyBadgeProps {
  urgencyLevel?: string | number;
}

export const CROUrgencyBadge: React.FC<CROUrgencyBadgeProps> = ({
  urgencyLevel = "medium",
}) => {
  const urgencyMap: Record<string, { color: string; label: string; icon: React.FC<any> }> = {
    high: { color: "bg-red-100 text-red-700 border-red-200", label: "High Urgency", icon: AlertCircle },
    medium: { color: "bg-yellow-100 text-yellow-700 border-yellow-200", label: "Medium Urgency", icon: Clock },
    low: { color: "bg-green-100 text-green-700 border-green-200", label: "Low Urgency", icon: CheckCircle },
  };

  const urgencyStr = String(urgencyLevel).toLowerCase();
  const config = urgencyMap[urgencyStr] || urgencyMap["medium"];
  const Icon = config.icon;

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${config.color}`}>
      <Icon size={14} />
      <span>{config.label}</span>
    </div>
  );
};

interface CROInlineCompactProps {
  data?: any;
  children?: React.ReactNode;
}

export const CROInlineCompact: React.FC<CROInlineCompactProps> = ({ data, children }) => {
  return (
    <div className="text-sm text-slate-600">
      {children || JSON.stringify(data)}
    </div>
  );
};

interface CROQuickViewProps {
  data?: any;
  children?: React.ReactNode;
}

export const CROQuickView: React.FC<CROQuickViewProps> = ({ data, children }) => {
  return (
    <div className="p-2 text-xs bg-slate-50 rounded border border-slate-200">
      {children || JSON.stringify(data)}
    </div>
  );
};
