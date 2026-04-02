"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import * as d3 from "d3";

interface CandidateData {
  user_id: string;
  full_name: string;
  experience: string;
  years_of_experience: number;
  skills: string[];
  location: string;
  location_tier: string | null;
  expected_salary: number | null;
}

interface TalentBubbleChartProps {
  data: CandidateData[];
}

interface BubbleNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  value: number;
  radius: number;
  color: string;
  details: any;
}

const TIER_1_CITIES = ['bangalore', 'bengaluru', 'mumbai', 'delhi', 'hyderabad', 'chennai', 'kolkata', 'pune', 'ahmedabad'];
const TIER_2_CITIES = ['jaipur', 'lucknow', 'nagpur', 'indore', 'thiruvananthapuram', 'kochi', 'coimbatore', 'madurai', 'mysore', 'chandigarh', 'bhopal', 'surat', 'patna', 'ranchi'];

function getCityTier(location: string): string {
  if (!location) return "Unspecified";
  const loc = location.toLowerCase();
  if (TIER_1_CITIES.some(city => loc.includes(city))) return "Tier 1";
  if (TIER_2_CITIES.some(city => loc.includes(city))) return "Tier 2";
  return "Tier 3";
}

const COLORS = {
  fresher: "#06b6d4",    // Vibrant Cyan
  mid: "#0891b2",        // Darker Cyan
  senior: "#0e7490",     // Teal
  leadership: "#164e63"  // Dark Teal
};

const BAND_LABELS: Record<string, string> = {
  fresher: "Entry Level",
  mid: "Intermediate",
  senior: "Senior",
  leadership: "Leadership"
};

export default function TalentBubbleChart({ data }: TalentBubbleChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverNode, setHoverNode] = useState<BubbleNode | null>(null);

  const aggregateData = useMemo(() => {
    const bands = ["fresher", "mid", "senior", "leadership"];
    const results: BubbleNode[] = bands.map(band => {
      const candidates = data.filter(c => (c.experience || "").toLowerCase() === band);
      const count = candidates.length;
      
      // Calculate more details for the tooltip
      const avgSal = candidates.reduce((acc, c) => acc + (c.expected_salary || 0), 0) / (count || 1);
      const tierCounts: Record<string, number> = { "Tier 1": 0, "Tier 2": 0, "Tier 3": 0 };
      candidates.forEach(c => {
        const tier = c.location_tier || getCityTier(c.location);
        if (tierCounts[tier] !== undefined) tierCounts[tier]++;
      });

      return {
        id: band,
        name: BAND_LABELS[band] || band.toUpperCase(),
        value: count,
        radius: 0, // Will be set by scale
        color: COLORS[band as keyof typeof COLORS],
        details: {
          count,
          avgSal: (avgSal / 100000).toFixed(1),
          tiers: tierCounts
        }
      };
    });
    return results.filter(r => r.value > 0);
  }, [data]);

  useEffect(() => {
    if (!containerRef.current || aggregateData.length === 0) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    // Clear previous
    d3.select(containerRef.current).selectAll("svg").remove();

    const svg = d3.select(containerRef.current)
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [0, 0, width, height])
      .attr("style", "max-width: 100%; height: auto;");

    // Scale for bubble sizes - adjust range to prevent overlapping
    const maxValue = d3.max(aggregateData, d => d.value) || 10;
    const minRadius = Math.min(width, height) / 12;
    const maxRadius = Math.min(width, height) / 3.5;
    
    const radiusScale = d3.scaleSqrt()
      .domain([0, maxValue])
      .range([minRadius, maxRadius]);

    aggregateData.forEach(d => {
      d.radius = radiusScale(d.value);
    });

    const simulation = d3.forceSimulation(aggregateData)
      .force("x", d3.forceX(width / 2).strength(0.12))
      .force("y", d3.forceY(height / 2).strength(0.12))
      .force("collide", d3.forceCollide((d: any) => d.radius + 30).strength(1.0))
      .on("tick", () => {
        node.attr("transform", (d: any) => {
          // Constrain bubbles within bounds
          const constrainedX = Math.max(d.radius, Math.min(width - d.radius, d.x || 0));
          const constrainedY = Math.max(d.radius, Math.min(height - d.radius, d.y || 0));
          d.x = constrainedX;
          d.y = constrainedY;
          return `translate(${constrainedX},${constrainedY})`;
        });
      });

    // Pre-simulate for stable positioning
    for (let i = 0; i < 150; ++i) simulation.tick();

    const node = svg.append("g")
      .selectAll("g")
      .data(aggregateData)
      .join("g")
      .attr("cursor", "pointer")
      .on("mouseover", (event, d) => {
        setHoverNode(d);
        d3.select(event.currentTarget)
          .selectAll("circle:nth-child(1)")
          .transition()
          .duration(200)
          .attr("fill-opacity", 0.35);
        d3.select(event.currentTarget)
          .selectAll("circle:nth-child(2)")
          .transition()
          .duration(200)
          .attr("fill-opacity", 0.5);
      })
      .on("mouseout", (event, d) => {
        setHoverNode(null);
        d3.select(event.currentTarget)
          .selectAll("circle:nth-child(1)")
          .transition()
          .duration(200)
          .attr("fill-opacity", 0.15);
        d3.select(event.currentTarget)
          .selectAll("circle:nth-child(2)")
          .transition()
          .duration(200)
          .attr("fill-opacity", 0.25);
      });

    // Outer glow circle
    node.append("circle")
      .attr("r", d => d.radius)
      .attr("fill", d => d.color)
      .attr("fill-opacity", 0.15)
      .attr("stroke", d => d.color)
      .attr("stroke-width", 2)
      .attr("stroke-opacity", 0.3)
      .style("filter", "drop-shadow(0 0 8px " + "rgba(6, 182, 212, 0.3)" + ")");

    // Main circle
    node.append("circle")
      .attr("r", d => d.radius - 5)
      .attr("fill", d => d.color)
      .attr("fill-opacity", 0.25)
      .attr("stroke", d => d.color)
      .attr("stroke-width", 2)
      .attr("stroke-opacity", 0.4);

    // Label
    node.append("text")
      .attr("dy", "-0.5em")
      .attr("text-anchor", "middle")
      .attr("fill", "white")
      .attr("font-size", d => Math.max(10, d.radius / 4))
      .attr("font-weight", "900")
      .attr("class", "uppercase tracking-tighter italic shadow-sm")
      .text(d => d.name);

    // Count
    node.append("text")
      .attr("dy", "1em")
      .attr("text-anchor", "middle")
      .attr("fill", d => d.color)
      .attr("font-size", d => Math.max(12, d.radius / 3))
      .attr("font-weight", "black")
      .text(d => d.value);

    return () => simulation.stop();
  }, [aggregateData]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      
      {hoverNode && (
        <div 
          className="absolute top-4 left-4 z-50 p-5 bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl min-w-[240px] animate-in fade-in zoom-in duration-200"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="h-2 w-2 rounded-full animate-pulse" style={{ backgroundColor: hoverNode.color }} />
            <h4 className="text-sm font-black text-white uppercase tracking-[0.2em]">{hoverNode.name} SEGMENT</h4>
          </div>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-1">Population</p>
                <p className="text-xl font-black text-white tracking-tighter">{hoverNode.details.count} <span className="text-[10px] text-slate-400">Hits</span></p>
              </div>
              <div>
                <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-1">Avg Salary</p>
                <p className="text-xl font-black text-white tracking-tighter">?{hoverNode.details.avgSal}L</p>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-white/5">
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-[0.2em]">Geographic Density</p>
              {Object.entries(hoverNode.details.tiers).map(([tier, count]: any) => (
                <div key={tier} className="flex items-center justify-between">
                  <span className="text-[9px] font-bold text-slate-500 uppercase">{tier}</span>
                  <div className="flex items-center gap-2">
                    <div className="h-1 w-20 bg-white/5 rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-500"
                        style={{ 
                          width: `${(count / (hoverNode.details.count || 1)) * 100}%`,
                          backgroundColor: hoverNode.color 
                        }} 
                      />
                    </div>
                    <span className="text-[9px] font-black text-white">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
