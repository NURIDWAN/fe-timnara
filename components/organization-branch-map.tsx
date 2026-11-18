"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { type GeoJSONSource, type Map as MapLibreMap, type Marker } from "maplibre-gl";
import type { Branch } from "@/lib/api/types";

const styleUrl = "https://tiles.openfreemap.org/styles/bright";
const maxLatitude = 85.051129; // Web Mercator cannot display the poles.

type MapPoint = { latitude: number; longitude: number };

function hasMapCoordinates(point: MapPoint): boolean {
  return Number.isFinite(point.latitude) && Number.isFinite(point.longitude)
    && Math.abs(point.latitude) < maxLatitude && Math.abs(point.longitude) <= 180;
}

function geofence(point?: MapPoint, radiusMeters?: number): GeoJSON.FeatureCollection<GeoJSON.Polygon> {
  if (!point || !hasMapCoordinates(point) || !Number.isFinite(radiusMeters) || !radiusMeters || radiusMeters <= 0) {
    return { type: "FeatureCollection", features: [] };
  }

  const latitude = point.latitude * Math.PI / 180;
  const longitude = point.longitude * Math.PI / 180;
  const distance = radiusMeters / 6371008.8;
  const coordinates: [number, number][] = [];
  for (let i = 0; i <= 64; i++) {
    const bearing = i * 2 * Math.PI / 64;
    const lat = Math.asin(Math.sin(latitude) * Math.cos(distance) + Math.cos(latitude) * Math.sin(distance) * Math.cos(bearing));
    const lng = longitude + Math.atan2(Math.sin(bearing) * Math.sin(distance) * Math.cos(latitude), Math.cos(distance) - Math.sin(latitude) * Math.sin(lat));
    coordinates.push([lng * 180 / Math.PI, lat * 180 / Math.PI]);
  }
  return { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [coordinates] } }] };
}

export function OrganizationBranchMap({ branch, branches, onSelect, editable, draftPoint, radiusMeters, onPick }: {
  branch?: Branch;
  branches: Branch[];
  onSelect: (branch: Branch) => void;
  editable: boolean;
  draftPoint: MapPoint | null;
  radiusMeters: number;
  onPick: (point: MapPoint) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const markers = useRef<Marker[]>([]);
  const onSelectRef = useRef(onSelect);
  const onPickRef = useRef(onPick);
  const editableRef = useRef(editable);
  const [mapError, setMapError] = useState(false);
  onSelectRef.current = onSelect;
  onPickRef.current = onPick;
  editableRef.current = editable;
  const activePoint = useMemo(() => draftPoint ?? (branch && hasMapCoordinates(branch) ? branch : undefined), [draftPoint, branch]);

  useEffect(() => {
    if (!container.current) return;
    const initial = activePoint ?? branches.find(hasMapCoordinates);
    const instance = new maplibregl.Map({
      container: container.current,
      style: styleUrl,
      center: initial ? [initial.longitude, initial.latitude] : [117, -2],
      zoom: initial ? 14 : 4,
    });
    map.current = instance;
    instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left");
    instance.on("click", (event) => {
      if (!editableRef.current) return;
      const point = { latitude: Number(event.lngLat.lat.toFixed(6)), longitude: Number(event.lngLat.lng.toFixed(6)) };
      if (hasMapCoordinates(point)) onPickRef.current(point);
    });
    instance.on("error", (event) => {
      // An unavailable style/tile is actionable; never silently show a blank map.
      if (event.error) setMapError(true);
    });
    instance.on("load", () => {
      instance.addSource("geofence", { type: "geojson", data: geofence(activePoint, radiusMeters) });
      instance.addLayer({ id: "geofence-fill", type: "fill", source: "geofence", paint: { "fill-color": "#2563eb", "fill-opacity": 0.17 } });
      instance.addLayer({ id: "geofence-border", type: "line", source: "geofence", paint: { "line-color": "#2563eb", "line-width": 2 } });
    });
    return () => {
      markers.current.forEach((marker) => marker.remove());
      markers.current = [];
      map.current = null;
      instance.remove();
    };
    // Initialize the map only once. Subsequent data updates use the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!map.current) return;
    map.current.getCanvas().style.cursor = editable ? "crosshair" : "";
  }, [editable]);

  useEffect(() => {
    if (!map.current) return;
    const instance = map.current;
    markers.current.forEach((marker) => marker.remove());
    markers.current = branches.filter((item) => hasMapCoordinates(item) && !(editable && item.id === branch?.id)).map((item) => {
      const popup = document.createElement("div");
      const name = document.createElement("strong");
      name.textContent = item.name;
      popup.append(name, document.createElement("br"), document.createTextNode(`${item.code} · Radius ${item.radius_meters} m`));
      const marker = new maplibregl.Marker({ color: item.id === branch?.id ? "#2563eb" : "#64748b" })
        .setLngLat([item.longitude, item.latitude])
        .setPopup(new maplibregl.Popup({ offset: 20 }).setDOMContent(popup))
        .addTo(instance);
      marker.getElement().addEventListener("click", (event) => {
        event.stopPropagation();
        onSelectRef.current(item);
      });
      return marker;
    });
    return () => { markers.current.forEach((marker) => marker.remove()); markers.current = []; };
  }, [branches, branch?.id, editable]);

  useEffect(() => {
    const instance = map.current;
    if (!instance || !editable || !activePoint || !hasMapCoordinates(activePoint)) return;
    const marker = new maplibregl.Marker({ color: "#2563eb", draggable: true })
      .setLngLat([activePoint.longitude, activePoint.latitude])
      .addTo(instance);
    marker.on("dragend", () => {
      const { lat, lng } = marker.getLngLat();
      onPickRef.current({ latitude: Number(lat.toFixed(6)), longitude: Number(lng.toFixed(6)) });
    });
    return () => { marker.remove(); };
  }, [editable, activePoint]);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    const update = () => (instance.getSource("geofence") as GeoJSONSource | undefined)?.setData(geofence(activePoint, radiusMeters));
    if (instance.isStyleLoaded()) update();
    else instance.once("load", update);
    return () => { instance.off("load", update); };
  }, [activePoint, radiusMeters]);

  useEffect(() => {
    if (activePoint && hasMapCoordinates(activePoint)) map.current?.flyTo({ center: [activePoint.longitude, activePoint.latitude], zoom: 14 });
  }, [activePoint]);

  return <div className="relative h-[360px] overflow-hidden rounded-xl border bg-slate-100">
    <div ref={container} className="h-full w-full" aria-label="Peta cabang dan radius geofence" />
    {branch && !hasMapCoordinates(branch) && !draftPoint ? <p role="alert" className="absolute bottom-8 left-3 right-3 z-10 rounded-lg bg-amber-50 p-3 text-xs text-amber-900 shadow-sm">Koordinat {branch.name} ({branch.latitude}, {branch.longitude}) tidak dapat ditampilkan. {editable ? "Klik peta untuk memilih lokasi baru." : "Lokasi perlu diperbarui oleh pengelola cabang."}</p> : null}
    {mapError ? <p role="alert" className="absolute left-3 right-3 top-3 z-10 rounded-lg bg-red-50 p-3 text-xs text-red-900 shadow-sm">Peta belum dapat dimuat. Periksa koneksi ke tiles.openfreemap.org lalu muat ulang halaman.</p> : null}
  </div>;
}
