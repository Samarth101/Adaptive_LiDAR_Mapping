import { Globe, Mail, ArrowUpRight } from 'lucide-react';
import Image from 'next/image';

export default function Footer() {
  // Placeholder team members - you can update their names and roles!
  const teamMembers = [
    { name: 'Sparsh Gupta', role: 'Full Stack Developer' },
    { name: 'Samarth Bhandegaonkar', role: 'AI/ML Engineer' },
    { name: 'Prince Gupta', role: 'AI/ML Engineer' },
    { name: 'Nikhil Makhija', role: 'AI/ML Engineer' },
    { name: 'Sanskruti Malani', role: 'Frontend Developer' },
    { name: 'Devansh Gupta', role: 'Role' }
  ];

  return (
    <footer className="w-(calc(100%-64px)) mx-8 mt-8 bg-card/30 backdrop-blur-xs border border-border rounded-xl shadow-sm overflow-hidden transition-all duration-300 hover:bg-card/50">
      <div className="p-8 md:p-10">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12">
          {/* Project Info Section */}
          <div className="md:col-span-5 space-y-4">
            <h3 className="text-xl font-semibold bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
              Adaptive LiDAR Mapping
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed pe-4">
              A high-performance, real-time web dashboard for autonomous driving visualization.
              Featuring dynamic foveated resolution mapping, semantic segmentation, and seamless 3D point cloud rendering.
            </p>
            <div className="flex items-center gap-6 pt-3">
              <a href="https://github.com/Samarth101/Adaptive_LiDAR_Mapping" target="_blank" rel="noreferrer" className="w-fit h-fit rounded-full">
                <Image src="/github.svg" alt="GitHub" width={20} height={20} className="dark:invert opacity-70 hover:opacity-100 transition-opacity" />
              </a>
              <div className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground cursor-pointer underline underline-offset-4 decoration-muted-foreground/50 hover:decoration-foreground">
                View Docs
                <ArrowUpRight size={14} />
              </div>
            </div>
          </div>

          {/* Team Section */}
          <div className="md:col-span-7">
            <h4 className="text-xs text-muted-foreground mb-6 font-semibold tracking-wider">
              THE TEAM
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-8 gap-x-4">
              {teamMembers.map((member, i) => (
                <div key={i} className="flex flex-col group cursor-default">
                  <span className="font-medium text-foreground/90 group-hover:text-primary transition-colors">
                    {member.name}
                  </span>
                  <span className="text-sm text-muted-foreground mt-0.5">
                    {member.role}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="w-full bg-muted/30 border-t border-border px-8 py-5 flex flex-col sm:flex-row justify-between items-center gap-4">
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} Data Exploiters. All rights reserved.
        </p>
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          Smart India Hackathon 2026
        </p>
      </div>
    </footer>
  );
}
