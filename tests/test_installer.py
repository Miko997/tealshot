import importlib.util
from pathlib import Path
import unittest
import xml.etree.ElementTree as ET
import json
root = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('manage', root/'tools/manage.py')
manage = importlib.util.module_from_spec(spec)
spec.loader.exec_module(manage)

class InstallerTests(unittest.TestCase):
    def test_normalizes_aliases_and_order(self):
        self.assertEqual(manage.normalise_binding('<Super><Primary>S'),manage.normalise_binding('<Control><Super>s'))
    def test_does_not_touch_clipboard_binding(self):
        row={'binding':'<Control><Alt>v','command':'clipboard','name':'Clipboard'}
        self.assertEqual(manage.classify_conflicts([row],['<Control><Super>s']),([],[]))
    def test_legacy_capture_can_be_backed_up(self):
        row={'binding':'<Control><Super>s','command':"/bin/bash -lc 'sleep 5; flameshot gui --raw | wl-copy'"}
        self.assertEqual(manage.classify_conflicts([row],['<Control><Super>s']),([row],[]))
    def test_unrelated_command_is_not_overwritten(self):
        row={'binding':'<Control><Super>s','command':'code'}
        self.assertEqual(manage.classify_conflicts([row],['<Control><Super>s']),([],[row]))
    def test_no_false_flameshot_prefix_match(self):
        self.assertFalse(manage.is_legacy_capture('my-flameshot-helper'))
    def test_restore_only_when_binding_and_command_untouched(self):
        orig={'binding':'<Control><Super>s','command':'gnome-screenshot -a -d 5 -c'}
        self.assertTrue(manage.safe_to_restore({'binding':'','command':orig['command']},orig))
        self.assertFalse(manage.safe_to_restore({'binding':'<Alt>s','command':orig['command']},orig))
        self.assertFalse(manage.safe_to_restore({'binding':'','command':'code'},orig))
    def test_metadata_and_schema_match(self):
        metadata=json.loads((root/'extension/metadata.json').read_text())
        schema=ET.parse(root/'extension/schemas/org.gnome.shell.extensions.tealshot.gschema.xml').getroot().find('schema')
        self.assertEqual(metadata['settings-schema'],schema.attrib['id'])
        self.assertEqual(metadata['shell-version'],['50'])
        self.assertEqual(metadata['uuid'],manage.UUID)
    def test_default_has_no_unsolicited_shortcut(self):
        schema=ET.parse(root/'extension/schemas/org.gnome.shell.extensions.tealshot.gschema.xml')
        self.assertEqual(schema.find('.//key[@name="tealshot-capture"]/default').text,'[]')
    def test_timer_default_five_and_range(self):
        schema=ET.parse(root/'extension/schemas/org.gnome.shell.extensions.tealshot.gschema.xml')
        key=schema.find('.//key[@name="delay-seconds"]')
        self.assertEqual(key.find('default').text,'5')
        self.assertEqual(key.find('range').attrib,{'min':'1','max':'60'})

if __name__=='__main__':unittest.main()
