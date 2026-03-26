import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, Timestamp } from 'firebase/firestore';
import { ArrowLeft, MapPin, Navigation, Filter } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface JobMarker {
  id: string;
  service: string;
  description: string;
  lat: number;
  lng: number;
  budget: string;
  urgency: string;
  status: string;
  customerName: string;
  timestamp: string;
}

const JobMap = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const [jobs, setJobs] = useState<JobMarker[]>([]);
  const [radius, setRadius] = useState(5);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const userLat = user?.location_coords?.lat || 25.5941;
    const userLng = user?.location_coords?.lng || 85.1376;

    const map = L.map(mapRef.current, {
      zoomControl: false,
    }).setView([userLat, userLng], 13);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap © CARTO',
      maxZoom: 19
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Worker location marker
    const workerIcon = L.divIcon({
      className: 'worker-marker',
      html: `<div style="width:20px;height:20px;background:#f97316;border-radius:50%;border:3px solid white;box-shadow:0 0 15px rgba(249,115,22,0.6);"></div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });

    L.marker([userLat, userLng], { icon: workerIcon })
      .addTo(map)
      .bindPopup(`<b style="color:#f97316">📍 You (${user?.name})</b><br><span style="font-size:11px">${user?.skill || 'Worker'}</span>`);

    // Radius circle
    L.circle([userLat, userLng], {
      radius: radius * 1000,
      color: '#f97316',
      fillColor: '#f97316',
      fillOpacity: 0.05,
      weight: 1,
      dashArray: '5,5'
    }).addTo(map);

    mapInstance.current = map;

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, [user]);

  // Listen for job requests
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'requests'), (snap) => {
      const jobList = snap.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          service: data.service || 'Service',
          description: data.description || '',
          lat: data.lat || 25.5941,
          lng: data.lng || 85.1376,
          budget: data.budget || 'N/A',
          urgency: data.urgency || 'Normal',
          status: data.status || 'Searching',
          customerName: data.customerName || 'Customer',
          timestamp: data.createdAt ? (data.createdAt as Timestamp).toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'
        } as JobMarker;
      }).filter(j => j.status === 'Searching' || j.status === 'Pending');

      setJobs(jobList);

      // Add markers for each job
      if (mapInstance.current) {
        jobList.forEach(job => {
          const jobIcon = L.divIcon({
            className: 'job-marker',
            html: `<div style="width:32px;height:32px;background:${job.urgency === 'Urgent' ? '#ef4444' : '#3b82f6'};border-radius:12px;border:2px solid white;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 4px 15px rgba(0,0,0,0.3);">🔧</div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16]
          });

          L.marker([job.lat, job.lng], { icon: jobIcon })
            .addTo(mapInstance.current!)
            .bindPopup(`
              <div style="min-width:200px;font-family:system-ui">
                <div style="font-weight:900;font-size:14px;color:#1e293b;margin-bottom:4px">${job.service}</div>
                <div style="font-size:11px;color:#64748b;margin-bottom:8px">${job.description.slice(0, 80)}${job.description.length > 80 ? '...' : ''}</div>
                <div style="display:flex;justify-content:space-between;font-size:11px">
                  <span style="color:#16a34a;font-weight:700">${job.budget}</span>
                  <span style="color:${job.urgency === 'Urgent' ? '#ef4444' : '#3b82f6'};font-weight:700">${job.urgency}</span>
                </div>
                <div style="font-size:10px;color:#94a3b8;margin-top:4px">By ${job.customerName} • ${job.timestamp}</div>
              </div>
            `);
        });
      }
    });

    return () => unsub();
  }, []);

  if (!user || user.role !== 'worker') {
    navigate('/');
    return null;
  }

  return (
    <div className="h-screen w-full relative">
      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 z-[1000] p-4">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-950/90 backdrop-blur-xl border border-white/10 text-white text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 transition-all">
            <ArrowLeft size={14} /> Back
          </button>
          <div className="px-4 py-2 rounded-2xl bg-slate-950/90 backdrop-blur-xl border border-white/10 text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-2">
            <Navigation size={14} className="text-orange-500" />
            {jobs.length} Jobs Nearby
          </div>
        </div>
      </div>

      {/* Map Container */}
      <div ref={mapRef} className="h-full w-full" style={{ background: '#0f172a' }} />

      {/* Bottom Info */}
      <div className="absolute bottom-16 sm:bottom-20 left-3 right-3 sm:left-4 sm:right-4 z-[1000]">
        <div className="rounded-[2rem] bg-slate-950/95 backdrop-blur-xl border border-white/10 p-5 sm:p-6 shadow-2xl">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-center sm:text-left">
              <div className="text-[7px] sm:text-[9px] font-black text-slate-600 uppercase tracking-[0.3em]">Job Radar Active</div>
              <div className="text-base sm:text-lg font-black text-white italic tracking-tighter uppercase">
                {jobs.length} open requests
              </div>
            </div>
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                <span className="text-[7px] sm:text-[8px] font-black text-slate-500 uppercase">Normal</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                <span className="text-[7px] sm:text-[8px] font-black text-slate-500 uppercase">Urgent</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JobMap;
