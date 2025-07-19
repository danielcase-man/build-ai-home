import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface VendorResearchStagingProps {
  projectId: string;
}

interface StagingRecord {
  id: string;
  category_name: string;
  search_query: string;
  raw_firecrawl_data: any;
  extracted_vendors: any;
  processing_status: string;
  processing_notes: string;
  created_at: string;
  processed_at?: string;
}

export const VendorResearchStaging = ({ projectId }: VendorResearchStagingProps) => {
  const [stagingRecords, setStagingRecords] = useState<StagingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRecords, setExpandedRecords] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchStagingRecords();
  }, [projectId]);

  const fetchStagingRecords = async () => {
    try {
      const { data, error } = await supabase
        .from('vendor_research_staging')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setStagingRecords(data || []);
    } catch (error) {
      console.error('Error fetching staging records:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpanded = (recordId: string) => {
    const newExpanded = new Set(expandedRecords);
    if (newExpanded.has(recordId)) {
      newExpanded.delete(recordId);
    } else {
      newExpanded.add(recordId);
    }
    setExpandedRecords(newExpanded);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { color: 'bg-yellow-500', icon: AlertTriangle, label: 'Pending' },
      raw_data_collected: { color: 'bg-blue-500', icon: CheckCircle, label: 'Data Collected' },
      vendors_extracted: { color: 'bg-green-500', icon: CheckCircle, label: 'Vendors Extracted' },
      no_vendors_extracted: { color: 'bg-orange-500', icon: AlertTriangle, label: 'No Vendors Found' },
      no_data_found: { color: 'bg-red-500', icon: XCircle, label: 'No Data Found' },
      insert_failed: { color: 'bg-red-500', icon: XCircle, label: 'Insert Failed' },
      completed: { color: 'bg-green-500', icon: CheckCircle, label: 'Completed' },
    };

    const config = statusConfig[status] || { color: 'bg-gray-500', icon: AlertTriangle, label: status };
    const Icon = config.icon;

    return (
      <Badge className={`${config.color} text-white`}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  if (loading) {
    return <div className="p-4">Loading research staging data...</div>;
  }

  if (stagingRecords.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Research Staging</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No research data found. Run a vendor search to see staging results.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Research Staging Data</CardTitle>
          <p className="text-sm text-muted-foreground">
            Raw data from vendor research attempts. This helps debug what Firecrawl is returning.
          </p>
        </CardHeader>
      </Card>

      {stagingRecords.map((record) => (
        <Card key={record.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">{record.category_name}</CardTitle>
                <p className="text-sm text-muted-foreground">{record.search_query}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(record.created_at).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center space-x-2">
                {getStatusBadge(record.processing_status)}
                <Collapsible
                  open={expandedRecords.has(record.id)}
                  onOpenChange={() => toggleExpanded(record.id)}
                >
                  <CollapsibleTrigger className="p-1">
                    {expandedRecords.has(record.id) ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </CollapsibleTrigger>
                </Collapsible>
              </div>
            </div>
          </CardHeader>

          <Collapsible
            open={expandedRecords.has(record.id)}
            onOpenChange={() => toggleExpanded(record.id)}
          >
            <CollapsibleContent>
              <CardContent className="space-y-4">
                {record.processing_notes && (
                  <div>
                    <h4 className="font-semibold text-sm mb-2">Processing Notes:</h4>
                    <p className="text-sm text-muted-foreground">{record.processing_notes}</p>
                  </div>
                )}

                {record.extracted_vendors && (
                  <div>
                    <h4 className="font-semibold text-sm mb-2">Extracted Vendors:</h4>
                    <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-60">
                      {JSON.stringify(record.extracted_vendors, null, 2)}
                    </pre>
                  </div>
                )}

                <div>
                  <h4 className="font-semibold text-sm mb-2">Raw Firecrawl Data:</h4>
                  <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-60">
                    {JSON.stringify(record.raw_firecrawl_data, null, 2)}
                  </pre>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      ))}
    </div>
  );
};