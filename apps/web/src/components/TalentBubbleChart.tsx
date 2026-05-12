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

const BRAND_ORANGE = "#FF8A00";

const BAND_LABELS: Record<string, string> = {
  fresher: "Entry Level",
  mid: "Intermediate",
  senior: "Senior",
  leadership: "Leadership"
};

function getLabelLines(name: string, radius: number): string[] {
  const words = name.trim().split(/\s+/);
  if (words.length > 1 && radius < 120) {
    return words;
  }
  return [name];
}

function getLabelFontSize(radius: number, name: string): number {
  const perCharBudget = (radius * 1.45) / Math.max(name.length, 1);
  const adaptive = Math.min(radius * 0.36, perCharBudget * 1.65);
  return Math.max(12, Math.min(58, adaptive));
}

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
        color: BRAND_ORANGE,
        details: {
          count,
          avgSal: (avgSal / 100000).toFixed(1),
          tiers: tierCounts
        }
      };
    });
    const filtered = results.filter(r => r.value > 0);
    const minCount = d3.min(filtered, d => d.value) ?? 0;
    const maxCount = d3.max(filtered, d => d.value) ?? 1;
    const colorScale = d3.scaleLinear<string>()
      .domain([minCount, maxCount])
      .range(["#FFC98E", "#FF8A00"])
      .interpolate(d3.interpolateRgb);

    filtered.forEach((node) => {
      node.color = colorScale(node.value);
    });

    return filtered;
  }, [data]);

  useEffect((): undefined | (() => void) => {
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

    // Scale for bubble sizes
    const minValue = d3.min(aggregateData, d => d.value) || 0;
    const maxValue = d3.max(aggregateData, d => d.value) || 10;
    const minRadius = Math.max(64, Math.min(width, height) / 11);
    const maxRadius = Math.max(minRadius + 24, Math.min(width, height) / 3.45);
    
    const radiusScale = d3.scaleSqrt()
      .domain([minValue, maxValue])
      .range([minRadius, maxRadius]);

    aggregateData.forEach(d => {
      d.radius = radiusScale(d.value);
    });

    const simulation = d3.forceSimulation(aggregateData)
      .force("x", d3.forceX(width / 2).strength(0.12))
      .force("y", d3.forceY(height / 2).strength(0.12))
      .force("collide", d3.forceCollide((d: any) => d.radius + 22).strength(1.0))
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
          .select("circle")
          .transition()
          .duration(200)
            .attr("filter", "drop-shadow(0 12px 24px rgba(255, 138, 0, 0.34))")
          .attr("opacity", 1);
      })
      .on("mouseout", (event, d) => {
        setHoverNode(null);
        d3.select(event.currentTarget)
          .select("circle")
          .transition()
          .duration(200)
            .attr("filter", "drop-shadow(0 8px 18px rgba(255, 138, 0, 0.22))")
          .attr("opacity", 0.96);
      });

    // Single-layer brand bubble without ring borders
    node.append("circle")
      .attr("r", d => d.radius)
      .attr("fill", d => d.color)
      .attr("stroke", "none")
      .attr("opacity", 0.96)
      .attr("filter", "drop-shadow(0 8px 18px rgba(255, 138, 0, 0.22))")
      .style("transition", "all 0.3s ease");

    // Adaptive label kept fully inside the bubble
    const label = node.append("text")
      .attr("text-anchor", "middle")
      .attr("fill", "white")
      .attr("font-size", d => getLabelFontSize(d.radius, d.name))
      .attr("font-weight", "900")
      .attr("class", "uppercase italic")
      .style("text-shadow", "0 2px 8px rgba(0, 0, 0, 0.3)")
      .style("letter-spacing", "0.02em");

    label.each(function(d) {
      const lines = getLabelLines(d.name, d.radius);
      const textSel = d3.select(this);
      const lineHeight = lines.length > 1 ? 0.95 : 1.0;
      const startOffset = lines.length > 1 ? -0.85 : -0.55;

      lines.forEach((line, i) => {
        textSel.append("tspan")
          .attr("x", 0)
          .attr("dy", i === 0 ? `${startOffset}em` : `${lineHeight}em`)
          .text(line);
      });
    });

    // Count
    node.append("text")
      .attr("dy", d => (getLabelLines(d.name, d.radius).length > 1 ? "1.8em" : "0.95em"))
      .attr("text-anchor", "middle")
      .attr("fill", "white")
      .attr("font-size", d => Math.max(18, Math.min(64, d.radius * 0.42)))
      .attr("font-weight", "900")
      .style("text-shadow", "0 2px 8px rgba(0, 0, 0, 0.3)")
      .text(d => d.value);

    return () => simulation.stop();
  }, [aggregateData]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      
      {hoverNode && (
        <div 
          className="absolute top-4 left-4 z-50 p-6 bg-gradient-to-br from-[#FF8A00] to-[#FF6B00] backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl min-w-[280px] animate-in fade-in zoom-in duration-200"
        >
          <div className="flex items-center gap-3 mb-5">
            <div className="h-3 w-3 rounded-full animate-pulse bg-white/80" />
            <h4 className="text-sm font-black text-white uppercase tracking-[0.2em]">{hoverNode.name}</h4>
          </div>
          
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/15 backdrop-blur-sm rounded-xl p-3.5 border border-white/20">
                <p className="text-[8px] font-bold text-white/70 uppercase tracking-widest mb-2">Population</p>
                <p className="text-2xl font-black text-white tracking-tighter">{hoverNode.details.count}</p>
                <p className="text-[9px] text-white/60 mt-1">Candidates</p>
              </div>
              <div className="bg-white/15 backdrop-blur-sm rounded-xl p-3.5 border border-white/20">
                <p className="text-[8px] font-bold text-white/70 uppercase tracking-widest mb-2">Avg Salary</p>
                <p className="text-2xl font-black text-white tracking-tighter">₹{hoverNode.details.avgSal}L</p>
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-white/20">
              <p className="text-[8px] font-bold text-white/70 uppercase tracking-[0.2em]">Geographic Spread</p>
              {Object.entries(hoverNode.details.tiers).map(([tier, count]: any) => (
                <div key={tier} className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-white/80 uppercase">{tier}</span>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-20 bg-white/20 rounded-full overflow-hidden border border-white/30">
                      <div 
                        className="h-full rounded-full transition-all duration-500 bg-white/70"
                        style={{ 
                          width: `${(count / (hoverNode.details.count || 1)) * 100}%`
                        }} 
                      />
                    </div>
                    <span className="text-[10px] font-black text-white">{count}</span>
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
