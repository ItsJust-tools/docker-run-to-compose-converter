const toolConfig = {
  id: 'docker-run-to-compose-converter',
  name: 'Docker Run to Compose Converter',
  version: '1.0.0',
  description:
    'Converts docker run commands into equivalent docker-compose.yml service definitions with live YAML output and copy support.',
  exportFormats: ['png', 'jpeg', 'webp', 'pdf'],
  features: {
    export: true,
    autoSave: true,
    undoRedo: false,
    sidebar: true,
    statusBar: true,
    darkMode: true,
  },
  theme: { brand: 'Docker Run to Compose Converter', icon: '🐳' },
  shortcuts: [
    {
      title: 'Compose Converter',
      shortcuts: [
        { keys: 'C', label: 'Copy YAML', description: 'Copy the generated docker-compose.yml' },
        { keys: 'H', label: 'Save history', description: 'Save the current conversion' },
      ],
    },
  ],
} satisfies import('@itsjust/core').ToolConfig;

export default toolConfig;
export { toolConfig };
