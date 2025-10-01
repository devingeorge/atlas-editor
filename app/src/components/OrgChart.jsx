import React, { useState, useEffect } from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  ConnectionMode,
} from 'reactflow';
import 'reactflow/dist/style.css';

const OrgChart = ({ data, selectedUser, onUserSelect, onStageChange }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [draggedNode, setDraggedNode] = useState(null);

  // Build tree structure and convert to ReactFlow format
  useEffect(() => {
    if (!data || data.length === 0) return;

    // Find root nodes (users with no manager)
    const rootUsers = data.filter(user => !user.managerId);
    
    // Build tree structure
    const buildTree = (parentId = null, level = 0) => {
      const children = data.filter(user => user.managerId === parentId);
      const result = [];
      
      children.forEach((user, index) => {
        const nodeId = user.id;
        const x = level * 300;
        const y = index * 150;
        
        result.push({
          id: nodeId,
          type: 'custom',
          position: { x, y },
          data: {
            ...user,
            isSelected: selectedUser?.id === user.id,
            onSelect: () => onUserSelect(user),
          },
        });
        
        // Add children recursively
        const childNodes = buildTree(nodeId, level + 1);
        result.push(...childNodes);
      });
      
      return result;
    };

    const flowNodes = buildTree();
    
    // Create edges
    const flowEdges = data
      .filter(user => user.managerId)
      .map(user => ({
        id: `${user.managerId}-${user.id}`,
        source: user.managerId,
        target: user.id,
        type: 'smoothstep',
        animated: false,
      }));

    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [data, selectedUser]);

  const onConnect = (params) => {
    setEdges((eds) => addEdge(params, eds));
  };

  const handleNodeDragStart = (event, node) => {
    setDraggedNode(node);
  };

  const handleNodeDragStop = (event, node) => {
    if (draggedNode) {
      // Find the node under the cursor
      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      
      // Simple hit detection - find closest node
      const targetNode = nodes.find(n => {
        const nodeRect = {
          left: n.position.x,
          top: n.position.y,
          right: n.position.x + 200,
          bottom: n.position.y + 100,
        };
        return x >= nodeRect.left && x <= nodeRect.right && 
               y >= nodeRect.top && y <= nodeRect.bottom;
      });

      if (targetNode && targetNode.id !== draggedNode.id) {
        // Stage the manager change
        onStageChange({
          type: 'manager',
          payload: {
            userId: draggedNode.id,
            oldManagerId: draggedNode.data.managerId,
            newManagerId: targetNode.id,
          },
        });
      }
    }
    setDraggedNode(null);
  };

  return (
    <div className="org-chart-container">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStart={handleNodeDragStart}
        onNodeDragStop={handleNodeDragStop}
        connectionMode={ConnectionMode.Loose}
        fitView
        attributionPosition="bottom-left"
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
};

// Custom node component
const CustomNode = ({ data }) => {
  const getInitials = (name) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div 
      className={`node-card ${data.isSelected ? 'selected' : ''}`}
      onClick={data.onSelect}
    >
      <div className="node-avatar">
        {data.avatar ? (
          <img 
            src={data.avatar} 
            alt={data.name}
            style={{ width: '100%', height: '100%', borderRadius: '50%' }}
          />
        ) : (
          getInitials(data.name)
        )}
      </div>
      <div className="node-name">{data.name}</div>
      <div className="node-title">{data.title}</div>
      <div className="node-reports">
        {data.reportsCount || 0} reports
      </div>
    </div>
  );
};

// Register custom node type
const nodeTypes = {
  custom: CustomNode,
};

export default OrgChart;
