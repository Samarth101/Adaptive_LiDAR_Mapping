import type { Metadata } from "next";
import { Inter, Geist, Caveat } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const caveat = Caveat({
  variable: "--font-cursive",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Adaptive 2.5D LiDAR Mapping · Autonomous Driving Demo",
  description: "3D LiDAR point cloud visualization of an adaptive variable-resolution 2.5D mapping pipeline for autonomous navigation on Indian urban roads.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("dark font-sans", geist.variable, caveat.variable)}>
      <head>
      </head>
      <body className="font-sans">{children}</body>
    </html>
  );
}
