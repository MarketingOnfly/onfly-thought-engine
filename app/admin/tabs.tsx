"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Campaign, OrgDocument } from "@/lib/db/types";
import OrgDocsPanel from "./org-docs-panel";
import CampaignsPanel from "./campaigns-panel";
import LeadersPanel from "./leaders-panel";
import BroadcastsPanel from "./broadcasts-panel";

export type LeaderLite = {
  user_id: string;
  full_name: string;
  role: string;
  area: string;
};

export default function AdminTabs({
  initialDocs,
  initialCampaigns,
  activeLeaders,
  leaders,
}: {
  initialDocs: OrgDocument[];
  initialCampaigns: Campaign[];
  activeLeaders: number;
  leaders: LeaderLite[];
}) {
  return (
    <Tabs defaultValue="leaders" className="mt-8">
      <TabsList>
        <TabsTrigger value="leaders">Líderes</TabsTrigger>
        <TabsTrigger value="campaigns">
          Campanhas ({initialCampaigns.length})
        </TabsTrigger>
        <TabsTrigger value="broadcasts">Avisos</TabsTrigger>
        <TabsTrigger value="docs">Guidelines ({initialDocs.length})</TabsTrigger>
      </TabsList>

      <TabsContent value="leaders">
        <LeadersPanel />
      </TabsContent>

      <TabsContent value="campaigns">
        <CampaignsPanel
          initial={initialCampaigns}
          activeLeaders={activeLeaders}
          leaders={leaders}
        />
      </TabsContent>

      <TabsContent value="broadcasts">
        <BroadcastsPanel />
      </TabsContent>

      <TabsContent value="docs">
        <OrgDocsPanel initial={initialDocs} />
      </TabsContent>
    </Tabs>
  );
}
